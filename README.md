# React Appwrite Blog
This project was created while learning backend development from the Chai aur Code series. I've implemented additional features to complete and enhance the project, transforming it into a complete backend for comprehensive video hosting platform. 

## API Documentation
- [Postman API Documentation]()
## Tech Stack
- **Node**
- **Express** - Controller, Router, Middlewares,  Error Handling, File Handling(multer), JWT Authentication
- **MongoDb** - Aggregation Pipelines, mongoose ORM
- **Cloudinary** - File Management

## Features
- User Authentication: Register, log in, and log out functionalities with JWT.
- Subscriptions: Subscribe and unsubscribe from channels
- User Interactions: Like, dislike, comment to videos.
- Video Management: Upload, edit, and delete videos.
- Secure Authentication: Using JWT Access Tokens and Refresh Tokens

## Project Structure
- src/: Contains the server-side code.
  - controllers/: Functions to handle the requests.
  - models/: MongoDB models for User, Video, Comment, etc.
  - routes/: API routes for various functionalities.
  - middlewares/: Custom middleware for authentication, error handling, etc.
  - utils/: Utility functions and helpers for Error and API Handling.
