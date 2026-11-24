export function uploadVideoFile(url: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.upload.onprogress = ({ loaded }) => {
      onProgress(Math.min(99, Math.floor((loaded / file.size) * 100)));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error("影片上傳失敗，請稍後重試；若持續發生，請聯絡管理員檢查儲存服務設定"));
      }
    };
    request.onerror = request.onabort = () => {
      reject(new Error("影片上傳失敗，請檢查網路連線後重試"));
    };
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.send(file);
  });
}
