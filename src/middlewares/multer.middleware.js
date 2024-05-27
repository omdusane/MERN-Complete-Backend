import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
    //   can configure it to generate unique file name to avoid conflicts
      cb(null, file.originalname)
    }
  })
  
export const upload = multer({ 
    storage, 
})