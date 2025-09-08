import pdf from 'pdf-parse';
import fs from 'fs';

export const extractTextFromPDF = async (filePath: string): Promise<Record<string, any>> => {
  try {
    // console.log("Extracting text from PDF...", filePath)
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    // console.log(data)
    
    return {
      text: data.text,
      metadata: data.info,
      numPages: data.numpages
    };
  } catch (error:any) {
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
};