/** The workspace owner — the one account no other admin can touch. Stored in
 *  Settings ("owner.userId") so it works everywhere without an env var. */
import { getSetting } from "./settings";

export async function getOwnerId(): Promise<string> {
  return getSetting("owner.userId");
}

/** Throws if `actorId` is trying to modify the owner and isn't the owner. */
export async function assertCanModify(targetId: string, actorId: string): Promise<void> {
  const owner = await getOwnerId();
  if (owner && targetId === owner && actorId !== owner) {
    throw new Error("This is the workspace owner's account — only the owner can change it.");
  }
}
