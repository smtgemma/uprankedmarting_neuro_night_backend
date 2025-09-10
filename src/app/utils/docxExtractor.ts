import mammoth from 'mammoth';

export const extractTextFromDocx = async (filePath: string): Promise<Record<string, any>> => {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    
    return {
      text: result.value,
      messages: result.messages
    };
  } catch (error:any) {
    throw new Error(`Failed to extract text from DOCX: ${error.message}`);
  }
};