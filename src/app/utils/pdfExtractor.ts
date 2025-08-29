import pdf from 'pdf-parse';
import fs from 'fs';

export const extractTextFromPDF = async (filePath: string): Promise<Record<string, any>> => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    
    return {
      text: data.text,
      metadata: data.info,
      numPages: data.numpages
    };
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
};