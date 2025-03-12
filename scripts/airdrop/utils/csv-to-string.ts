import * as fs from 'fs';

export const readFromCSV = (filePath: string): Promise<{ rows: string[]; csvData: string[][] }> => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      const rows = data.split('\n');
      const csvData = rows.map((row) => row.split(',').filter((row) => !!row));

      const result = { rows, csvData };
      resolve(result);
    });
  });
};
