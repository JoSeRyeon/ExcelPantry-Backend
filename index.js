import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import bodyParser from 'body-parser';
import fileUpload from 'express-fileupload';
import excelRoutes from './routes/excelRoutes.js';
import calcRoutes from './routes/calcRoutes.js';
import configRoutes from './routes/configRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
// app.use(fileUpload());
app.use(fileUpload({
  createParentPath: true   // uploads 폴더 없으면 자동 생성
}));

app.use('/api', configRoutes);
app.use('/excel', excelRoutes);
app.use('/calc', calcRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));