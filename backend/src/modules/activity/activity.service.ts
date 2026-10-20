import { UnlockedService } from "../base.service";
import type { ActivityEvent } from "./activity.util";

export class ActivityService extends UnlockedService {
  public async list(limit = 100): Promise<ActivityEvent[]> {
    return this.withVault((vault) =>
      [...(vault.activityLog ?? [])]
        .reverse()
        .slice(0, Math.min(Math.max(limit, 1), 500)),
    );
  }
}
