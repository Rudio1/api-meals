const multer = require('multer');
const { validateImageFile } = require('../utils/image-manager');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP'), false);
  }
};


const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fieldSize: 10 * 1024 * 1024
  }
});

/**
 * Middleware para upload de imagem única
 */
const uploadSingleImage = upload.single('image');

/**
 * Middleware para upload de múltiplas imagens
 */
const uploadMultipleImages = upload.array('images', 5); 

/**
 * Middleware personalizado para validação adicional
 */
const validateUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      error: 'Nenhuma imagem fornecida',
      message: 'Envie uma imagem no campo "image" ou "images"'
    });
  }

  if (req.file) {
    const validation = validateImageFile(req.file);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Arquivo inválido',
        message: validation.error
      });
    }
  }


  if (req.files && req.files.length > 0) {
    for (let i = 0; i < req.files.length; i++) {
      const validation = validateImageFile(req.files[i]);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Arquivo inválido',
          message: `Arquivo ${i + 1}: ${validation.error}`
        });
      }
    }
  }

  next();
};

/**
 * Middleware de tratamento de erros do multer
 */
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Arquivo muito grande',
        message: 'Tamanho máximo permitido: 5MB'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Muitos arquivos',
        message: 'Máximo de 5 imagens por upload'
      });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Campo inesperado',
        message: 'Use o campo "image" para upload único ou "images" para múltiplos'
      });
    }
  }
  
  if (error.message.includes('Tipo de arquivo não permitido')) {
    return res.status(400).json({
      error: 'Tipo de arquivo inválido',
      message: error.message
    });
  }
  
  next(error);
};

module.exports = {
  uploadSingleImage,
  uploadMultipleImages,
  validateUpload,
  handleUploadError
};
