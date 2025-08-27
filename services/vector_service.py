# services/vector_service.py
import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any
import logging
from core.config import settings
import os

logger = logging.getLogger(__name__)

class VectorService:
    def __init__(self):
        self.client = None
        self.embedding_model = None
        self.initialize()
    
    def initialize(self):
        """Initialize ChromaDB and embedding model"""
        try:
            # Create vector_db directory if it doesn't exist
            os.makedirs(settings.CHROMADB_PATH, exist_ok=True)
            
            # Initialize ChromaDB client
            self.client = chromadb.PersistentClient(
                path=settings.CHROMADB_PATH,
                settings=ChromaSettings(anonymized_telemetry=False)
            )
            
            # Initialize embedding model
            self.embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
            
            logger.info("Vector service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize vector service: {e}")
            raise
    
    def create_collection(self, conversation_id: str) -> Any:
        """Create a new collection for a conversation"""
        try:
            collection_name = f"conversation_{conversation_id}"
            collection = self.client.create_collection(
                name=collection_name,
                metadata={"conversation_id": conversation_id}
            )
            return collection
        except Exception as e:
            logger.error(f"Failed to create collection: {e}")
            raise
    
    def get_collection(self, conversation_id: str) -> Any:
        """Get existing collection for a conversation"""
        try:
            collection_name = f"conversation_{conversation_id}"
            return self.client.get_collection(collection_name)
        except Exception as e:
            logger.error(f"Failed to get collection: {e}")
            return None
    
    def chunk_text(self, text: str) -> List[Dict[str, Any]]:
        """Split text into chunks with metadata"""
        words = text.split()
        chunks = []
        
        for i in range(0, len(words), settings.CHUNK_SIZE - settings.CHUNK_OVERLAP):
            chunk_words = words[i:i + settings.CHUNK_SIZE]
            chunk_text = " ".join(chunk_words)
            
            chunks.append({
                "text": chunk_text,
                "chunk_id": f"chunk_{i // (settings.CHUNK_SIZE - settings.CHUNK_OVERLAP)}",
                "start_index": i,
                "end_index": min(i + settings.CHUNK_SIZE, len(words))
            })
        
        return chunks
    
    async def store_conversation(self, conversation_id: str, content: str):
        """Store conversation content in vector database"""
        try:
            # Create collection
            collection = self.create_collection(conversation_id)
            
            # Chunk the text
            chunks = self.chunk_text(content)
            
            # Generate embeddings and store
            texts = [chunk["text"] for chunk in chunks]
            embeddings = self.embedding_model.encode(texts).tolist()
            
            ids = [f"{conversation_id}_{chunk['chunk_id']}" for chunk in chunks]
            metadatas = [
                {
                    "conversation_id": conversation_id,
                    "chunk_id": chunk["chunk_id"],
                    "start_index": chunk["start_index"],
                    "end_index": chunk["end_index"]
                }
                for chunk in chunks
            ]
            
            collection.add(
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas,
                ids=ids
            )
            
            logger.info(f"Stored {len(chunks)} chunks for conversation {conversation_id}")
            
        except Exception as e:
            logger.error(f"Failed to store conversation: {e}")
            raise
    
    async def search_similar(self, conversation_id: str, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Search for similar chunks in the conversation"""
        try:
            collection = self.get_collection(conversation_id)
            if not collection:
                return []
            
            # Generate query embedding
            query_embedding = self.embedding_model.encode([query]).tolist()[0]
            
            # Search for similar chunks
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                include=['documents', 'metadatas', 'distances']
            )
            
            # Format results
            formatted_results = []
            if results['documents'] and results['documents'][0]:
                for i, doc in enumerate(results['documents'][0]):
                    # ChromaDB returns cosine distance, convert to similarity (0-1 range)
                    distance = results['distances'][0][i]
                    similarity = max(0.0, 1 - distance)  # Ensure non-negative
                    formatted_results.append({
                        "text": doc,
                        "metadata": results['metadatas'][0][i],
                        "similarity": similarity
                    })
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"Failed to search similar chunks: {e}")
            return []


