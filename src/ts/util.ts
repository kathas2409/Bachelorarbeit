
export function downloadFile(blobs: BlobPart[], type: string, fileName: string) {
  const blob = new Blob(blobs, { type: type });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}