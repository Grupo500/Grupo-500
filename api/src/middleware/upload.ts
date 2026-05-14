import multer from 'multer'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const pdfStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:   'grupo500/simulacros',
    resource_type: 'raw',   // PDFs y archivos binarios
    allowed_formats: ['pdf'],
    use_filename: true,
    unique_filename: true,
  } as any,
})

const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:   'grupo500/comprobantes',
    resource_type: 'auto',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    use_filename: true,
    unique_filename: true,
  } as any,
})

export const uploadPdf   = multer({ storage: pdfStorage,   limits: { fileSize: 20 * 1024 * 1024 } })  // 20 MB
export const uploadImage = multer({ storage: imageStorage, limits: { fileSize: 10 * 1024 * 1024 } })  // 10 MB
