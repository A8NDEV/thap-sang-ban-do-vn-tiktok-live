// PHÂN PHỐI — cổng bản quyền: chưa kích hoạt key thì không nhận sự kiện LIVE thật (TikTok, webhook ngoài);
// chạy thử / mô phỏng vẫn dùng được. Máy phát triển: có file %USERPROFILE%\.thap-sang-ban-do-dev
// (nằm ngoài thư mục tool nên không lọt vào bản phát hành) hoặc TSBD_NO_LICENSE=1 thì bỏ qua; TSBD_NO_LICENSE=0 để ép khóa khi test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DATA_DIR } from '../core/paths.mjs';
import { createLicense } from './ban-quyen.mjs';

const env = process.env.TSBD_NO_LICENSE;
const bypass = env ? env === '1' : fs.existsSync(path.join(os.homedir(), '.thap-sang-ban-do-dev'));
export const license = createLicense(DATA_DIR, { bypass });
export const LICENSE_MSG = 'Chưa kích hoạt bản quyền — nhập key ở đầu trang điều khiển.';
export const licenseMsg = () => ({ t: 'license', ...license.status(), activated: license.activated });
export const isDevMachine = bypass;   // máy phát triển: cập nhật chỉ kiểm tra, không chép đè mã nguồn
