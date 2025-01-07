import * as fs from 'fs';

export const readFromCSV = (filePath: string): Promise<{ rows: string[]; header: string[]; csvData: string[][] }> => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      const rows = data.split('\n');
      const header = rows[0].split(',').filter((row) => !!row);
      const csvData = rows.slice(1).map((row) => row.split(',').filter((row) => !!row));

      const result = { rows, header, csvData };
      resolve(result);
    });
  });
};
