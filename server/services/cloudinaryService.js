const fs = require('fs/promises')
const path = require('path')
const { v2: cloudinary } = require('cloudinary')

const localUploadDir = path.join(__dirname, '..', 'uploads')

const ensureLocalUploadDirectory = async () => {
  await fs.mkdir(localUploadDir, { recursive: true })
}

const getCloudinary = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return null
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  })

  return cloudinary
}

const uploadToLocalStorage = async (file, fallbackBaseUrl) => {
  await ensureLocalUploadDirectory()

  const safeName = `${Date.now()}-${String(file.originalname || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const filePath = path.join(localUploadDir, safeName)

  await fs.writeFile(filePath, file.buffer)

  const serverBaseUrl = fallbackBaseUrl || process.env.BACKEND_URL || process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5015}`
  const baseUrl = `${serverBaseUrl.replace(/\/$/, '')}/uploads/${safeName}`
  const resourceType = file.mimetype?.startsWith('image/') ? 'image' : file.mimetype?.startsWith('video/') ? 'video' : 'raw'

  return {
    secure_url: baseUrl,
    url: baseUrl,
    public_id: safeName,
    resource_type: resourceType,
    storage_provider: 'local',
  }
}

const uploadToCloudinary = async (file, fallbackBaseUrl) => {
  const client = getCloudinary()
  if (!client) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cloudinary must be configured for production uploads')
    }
    return uploadToLocalStorage(file, fallbackBaseUrl)
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = client.uploader.upload_stream(
        {
          folder: 'privet-connect',
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true,
          filename_override: file.originalname,
        },
        (error, uploadedFile) => {
          if (error) {
            reject(error)
            return
          }

          resolve(uploadedFile)
        },
      )

      stream.end(file.buffer)
    })
    return { ...result, storage_provider: 'cloudinary' }
  } catch (error) {
    if (process.env.NODE_ENV === 'production') throw error
    console.error('Cloudinary upload failed; using local storage:', error.message)
    return uploadToLocalStorage(file, fallbackBaseUrl)
  }
}

const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  const client = getCloudinary()
  if (!client || !publicId) return

  await client.uploader.destroy(publicId, { resource_type: resourceType })
}

module.exports = { getCloudinary, uploadToCloudinary, deleteFromCloudinary, uploadToLocalStorage }
