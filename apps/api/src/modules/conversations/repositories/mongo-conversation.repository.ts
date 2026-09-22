import { ObjectId, type Collection, type Db } from 'mongodb';
import type { ConversationRepository } from '../interfaces/conversation.repository.js';
import type { Conversation, Message, NewConversation } from '../types/conversation.js';

interface ConversationMongoDoc {
  _id: ObjectId;
  userId: ObjectId;
  documentIds: ObjectId[];
  messages: Message[];
  createdAt: Date;
}

function toDomain(doc: ConversationMongoDoc): Conversation {
  return {
    id: doc._id.toHexString(),
    userId: doc.userId.toHexString(),
    documentIds: doc.documentIds.map((id) => id.toHexString()),
    messages: doc.messages,
    createdAt: doc.createdAt,
  };
}

export function createMongoConversationRepository(db: Db): ConversationRepository {
  const collection: Collection<ConversationMongoDoc> = db.collection('conversations');

  return {
    insert: async (conversation: NewConversation): Promise<Conversation> => {
      const doc: ConversationMongoDoc = {
        _id: new ObjectId(),
        userId: new ObjectId(conversation.userId),
        documentIds: conversation.documentIds.map((id) => new ObjectId(id)),
        messages: conversation.messages,
        createdAt: conversation.createdAt,
      };

      await collection.insertOne(doc);
      return toDomain(doc);
    },

    findById: async (id: string, userId: string): Promise<Conversation | null> => {
      if (!ObjectId.isValid(id) || !ObjectId.isValid(userId)) {
        return null;
      }

      const doc = await collection.findOne({
        _id: new ObjectId(id),
        userId: new ObjectId(userId),
      });

      return doc ? toDomain(doc) : null;
    },

    appendMessages: async (
      id: string,
      userId: string,
      messages: Message[],
    ): Promise<Conversation | null> => {
      if (!ObjectId.isValid(id) || !ObjectId.isValid(userId)) {
        return null;
      }

      const doc = await collection.findOneAndUpdate(
        {
          _id: new ObjectId(id),
          userId: new ObjectId(userId),
        },
        {
          $push: {
            messages: {
              $each: messages,
            },
          },
        },
        {
          returnDocument: 'after',
        },
      );

      return doc ? toDomain(doc) : null;
    },
  };
}
