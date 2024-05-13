import crypto from 'crypto';
import express from 'express';
import filePickerController from '../controllers/filePicker.controller';

const filePickerRouter = express.Router();

filePickerRouter.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals['nonce'] = nonce;
  res.setHeader(
    'Content-Security-Policy',
    `script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline';`
  );
  next();
});

filePickerRouter
  .route('/:token/files')
  .get(filePickerController.viewFiles.bind(filePickerController));

filePickerRouter
  .route('/:token/files')
  .post(filePickerController.pickFiles.bind(filePickerController));

export default filePickerRouter;
