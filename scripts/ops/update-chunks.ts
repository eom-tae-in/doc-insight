import { PrismaClient, Prisma } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { OpenAI } from 'openai';
import { loadEnv } from '../shared/utils';

const improvedChunks = [
  {
    index: 0,
    text: `Deep learning is a transformative subset of machine learning that utilizes artificial neural networks with multiple layers to process and learn from vast amounts of data. These neural networks are inspired by the biological neurons found in animal brains and can automatically learn complex patterns and representations from raw input. Deep learning has become instrumental in solving previously intractable problems in computer vision, natural language processing, speech recognition, and game playing. The technique leverages the power of parallel computing and distributed systems to train massive models on billions of parameters. Applications of deep learning include autonomous vehicles, medical image analysis, language translation, and recommendation systems. The field has seen remarkable breakthroughs in recent years with innovations like convolutional neural networks, recurrent neural networks, and transformer architectures that have pushed the boundaries of what AI systems can accomplish.`,
  },
  {
    index: 1,
    text: `Natural language processing is a critical branch of artificial intelligence that focuses on enabling computers to understand, interpret, and generate human language in a meaningful and useful way. NLP combines computational linguistics with machine learning and deep learning to build systems that can process and analyze large volumes of natural language data. Modern NLP systems leverage transformer-based models like BERT and GPT that have demonstrated remarkable capabilities in understanding context and semantic meaning. These systems power applications such as machine translation, sentiment analysis, question answering systems, named entity recognition, and conversational AI. The field addresses fundamental challenges including understanding idioms, resolving ambiguities, capturing context across long documents, and generating coherent and contextually appropriate responses. Recent advances in large language models have created new possibilities for few-shot and zero-shot learning, where models can perform tasks with minimal training examples.`,
  },
  {
    index: 2,
    text: `Machine learning represents a fundamental paradigm shift in how we approach problem-solving in computer science and artificial intelligence. Unlike traditional programming where explicit instructions are provided, machine learning systems learn patterns and relationships directly from data. This approach enables systems to improve their performance on specific tasks through experience without being explicitly programmed for every scenario. Machine learning encompasses supervised learning where models learn from labeled examples, unsupervised learning where patterns are discovered in unlabeled data, and reinforcement learning where agents learn through interaction with environments. The field has practical applications across virtually every industry including healthcare diagnostics, financial forecasting, recommendation systems, fraud detection, and predictive maintenance. Key challenges in machine learning include handling imbalanced datasets, avoiding overfitting, ensuring model interpretability, managing computational resources, and addressing bias in training data.`,
  },
  {
    index: 3,
    text: `Computer vision is an interdisciplinary scientific field that seeks to develop techniques enabling computers to gain high-level understanding from digital images and videos. It combines methods from physics, mathematics, and engineering with insights from cognitive psychology to build systems that can perceive and interpret visual information much like humans do. Modern computer vision systems utilize deep learning architectures such as convolutional neural networks to achieve state-of-the-art performance in tasks like image classification, object detection, semantic segmentation, and pose estimation. These systems power real-world applications including autonomous driving, medical imaging and diagnosis, surveillance and security systems, quality control in manufacturing, augmented reality, and robotics. The field addresses fundamental problems such as how to handle variations in lighting, viewpoint, scale, and occlusion while maintaining robust performance. Recent advances in self-supervised learning and vision transformers have opened new avenues for building more efficient and generalizable computer vision systems.`,
  },
];

async function updateChunks() {
  const envVars = loadEnv();
  const dbUrl = envVars.DATABASE_URL;
  const apiKey = envVars.OPENAI_API_KEY;
  const embeddingModel = envVars.EMBEDDING_MODEL || 'text-embedding-3-small';

  if (!dbUrl || !apiKey) {
    console.error('❌ DATABASE_URL 또는 OPENAI_API_KEY가 누락되었습니다.');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('📊 청크 업데이트 시작...');
    const chunks = await prisma.documentChunk.findMany({
      orderBy: { chunkIndex: 'asc' },
    });

    for (let i = 0; i < chunks.length && i < improvedChunks.length; i++) {
      const chunk = chunks[i];
      const improvedText = improvedChunks[i].text;

      try {
        console.log(`\n[${i + 1}/${chunks.length}] 청크 업데이트 중...`);
        console.log(`  길이: ${chunk.text.length} → ${improvedText.length} 글자`);

        const response = await openai.embeddings.create({
          model: embeddingModel,
          input: improvedText,
          dimensions: 1536,
        });

        const embedding = response.data[0].embedding;

        await prisma.documentChunk.update({
          where: { id: chunk.id },
          data: {
            text: improvedText,
            embedding: embedding as Prisma.InputJsonValue,
          },
        });
        console.log(`✓ 완료 (임베딩 차원: ${embedding.length})`);
      } catch (error) {
        console.error(`❌ 실패: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log('\n✅ 모든 청크 업데이트 완료!');
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

updateChunks();
