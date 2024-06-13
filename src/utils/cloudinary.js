import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';
import {ApiError} from './ApiError.js';
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

const deleteOnCloudinary = async (oldImageUrl, publicId) => {
    try {

        if (!(oldImageUrl || publicId)) throw new ApiError(404, "oldImageUrl or publicId required");

        const result = await cloudinary.uploader.destroy(
            publicId,
            { resource_type: `${oldImageUrl.includes("image") ? "image" : "video"}` },
        )
        console.log("Asset deleted from Cloudinary:", result);
        return true;
    } catch (error) {
        console.error("Error deleting asset from Cloudinary:", error);
        throw new ApiError(500, error?.message || "Server error");
        return false;
    }

}

export {uploadOnCloudinary, deleteOnCloudinary}