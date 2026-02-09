import fs from 'fs';
import path from 'path';

function encodeFileToBase64(filePath: string): string {
    const fileContent = fs.readFileSync(filePath);
    return Buffer.from(fileContent).toString('base64');
}

function scanFolderForSVGFiles(folderPath: string): {[key: string]: string} {
    const svgFilesMap = {} as {[key: string]: string};

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
        if (path.extname(file).toLowerCase() === '.svg') {
            const filePath = path.join(folderPath, file);
            const fileBase64Content = encodeFileToBase64(filePath);
            svgFilesMap[path.basename(file, '.svg')] = fileBase64Content;
        }
    }

    return svgFilesMap;
}

export { scanFolderForSVGFiles };