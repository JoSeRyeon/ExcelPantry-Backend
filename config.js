// import path from 'path';

// export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// export const HEADER_KEYWORDS = [
//   '학교가', '행사가', '단위', '제품명', '품명', '규격', '유통기한'
// ];



import os from 'os';
import path from 'path';
import { pool } from './db.js';

export async function getUploadDir(userId, category) {
  // const { rows } = await pool.query(
  //   `SELECT folder_path
  //      FROM app_config
  //     WHERE user_id = $1
  //       AND category = $2`,
  //   [userId, category]
  // );

  // const relativePath = rows[0]?.folder_path || 'uploads';

  // // user_id가 1이면 홈 디렉터리와 결합, 아니면 DB값 그대로 반환
  // if (userId === 1) {
  //   return path.join(os.homedir(), relativePath);
  // }
  // return relativePath;

  return UPLOAD_DIR;
}

export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export const HEADER_KEYWORDS = [
  '학교가', '행사가', '단위', '제품명', '품명', '규격', '유통기한'
];

