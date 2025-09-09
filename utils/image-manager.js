const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { r2Client, R2_BUCKET, R2_PUBLIC_URL } = require('../config/cloudflare-r2');
const crypto = require('crypto');

/**
 * Gera um nome único para o arquivo baseado no timestamp e hash
 * @param {string} originalName - Nome original do arquivo
 * @param {string} prefix - Prefixo para organização (ex: 'posts', 'users')
 * @returns {string} - Nome único do arquivo
 */
const generateUniqueFileName = (originalName, prefix = 'posts') => {
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString('hex');
  const extension = originalName.split('.').pop().toLowerCase();
  return `${prefix}/${timestamp}-${randomHash}.${extension}`;
};

/**
 * Processa e otimiza a imagem
 * @param {Buffer} imageBuffer - Buffer da imagem
 * @param {Object} options - Opções de processamento
 * @returns {Buffer} - Buffer da imagem processada
 */
const processImage = async (imageBuffer, options = {}) => {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 85,
    format = 'jpeg'
  } = options;

  let sharpInstance = sharp(imageBuffer);

  // Redimensionar mantendo proporção
  sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
    fit: 'inside',
    withoutEnlargement: true
  });

  // Aplicar otimizações baseadas no formato
  switch (format) {
    case 'jpeg':
      sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
      break;
    case 'png':
      sharpInstance = sharpInstance.png({ quality, progressive: true });
      break;
    case 'webp':
      sharpInstance = sharpInstance.webp({ quality });
      break;
    default:
      sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
  }

  return await sharpInstance.toBuffer();
};

/**
 * Faz upload de uma imagem para o R2
 * @param {Buffer} imageBuffer - Buffer da imagem
 * @param {string} originalName - Nome original do arquivo
 * @param {Object} options - Opções de upload
 * @returns {Object} - Informações do upload
 */
const uploadImage = async (imageBuffer, originalName, options = {}) => {
  try {
    const {
      prefix = 'posts',
      processImage: shouldProcess = true,
      imageOptions = {}
    } = options;

    const processedBuffer = shouldProcess 
      ? await processImage(imageBuffer, imageOptions)
      : imageBuffer;

    const fileName = generateUniqueFileName(originalName, prefix);
    
    const contentType = `image/${imageOptions.format || 'jpeg'}`;
    
    const uploadCommand = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: fileName,
      Body: processedBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1 ano
      Metadata: {
        'original-name': originalName,
        'uploaded-at': new Date().toISOString(),
        'processed': shouldProcess.toString()
      }
    });

    await r2Client.send(uploadCommand);

    const publicUrl = `${R2_PUBLIC_URL}/${fileName}`;

    return {
      success: true,
      fileName,
      publicUrl,
      size: processedBuffer.length,
      contentType
    };

  } catch (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    throw new Error('Falha no upload da imagem');
  }
};

/**
 * Deleta uma imagem do R2
 * @param {string} fileName - Nome do arquivo no R2
 * @returns {boolean} - Sucesso da operação
 */
const deleteImage = async (fileName) => {
  try {
    
    const deleteCommand = new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: fileName
    });

    await r2Client.send(deleteCommand);
    return true;

  } catch (error) {
    console.error('Erro ao deletar imagem:', error);
    return false;
  }
};

/**
 * Valida se o arquivo é uma imagem válida
 * @param {Object} file - Objeto do arquivo do multer
 * @returns {Object} - Resultado da validação
 */
const validateImageFile = (file) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!file) {
    return { valid: false, error: 'Nenhum arquivo fornecido' };
  }

  if (!allowedTypes.includes(file.mimetype)) {
    return { 
      valid: false, 
      error: 'Tipo de arquivo não permitido. Use JPEG, PNG ou WebP' 
    };
  }

  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: 'Arquivo muito grande. Tamanho máximo: 5MB' 
    };
  }

  return { valid: true };
};

/**
 * Extrai o nome do arquivo da URL pública
 * @param {string} publicUrl - URL pública da imagem
 * @returns {string} - Nome do arquivo
 */
const extractFileNameFromUrl = (publicUrl) => {
  if (!publicUrl) return null;
  
  try {
    const url = new URL(publicUrl);
    return url.pathname.substring(1); // Remove a barra inicial
  } catch (error) {
    console.error('Erro ao extrair nome do arquivo da URL:', error);
    return null;
  }
};

module.exports = {
  uploadImage,
  deleteImage,
  validateImageFile,
  extractFileNameFromUrl,
  processImage
};
