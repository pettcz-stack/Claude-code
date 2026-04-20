import { prisma } from "../db";

export async function audit(params: {
  entityType: string;
  entityId: string;
  event: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      event: params.event,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}
