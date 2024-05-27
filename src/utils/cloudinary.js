import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary = async (localFilePath) =>{
    try {
        //uploader function
        const response = await cloudinary.uploader.upload(
            localFilePath, {
                resource_type: 'auto'
            }
        )
        console.log("File uploaded successfully", response.url);
        fs.existsSync(localFilePath) && fs.unlinkSync(localFilePath);
        return response;

    } catch (error) {
        // deletes file from local storage
        fs.existsSync(localFilePath) && fs.unlinkSync(localFilePath);
        console.log("Could Not upload file to server", error);
        return null;

    }
}

export {uploadOnCloudinary}