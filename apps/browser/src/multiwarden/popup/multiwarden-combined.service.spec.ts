import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { registerMultiAccountScope } from "@bitwarden/common/multiwarden/multi-account-scope";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";

import { MultiwardenCombinedService } from "./multiwarden-combined.service";

const combinedMode$ = new BehaviorSubject(true);
jest.mock("../multiwarden-settings", () => ({
  multiwardenSetting$: () => combinedMode$,
  updateMultiwardenSettings: jest.fn(async (changes: { combinedMode?: boolean }) => {
    if (changes.combinedMode != null) {
      combinedMode$.next(changes.combinedMode);
    }
  }),
}));

const userA = "user-a" as UserId;
const userB = "user-b" as UserId;

describe("MultiwardenCombinedService", () => {
  let service: MultiwardenCombinedService;
  let activeAccount$: BehaviorSubject<{ id: UserId; email: string } | null>;
  let messagingService: ReturnType<typeof mock<MessagingService>>;

  beforeEach(() => {
    registerMultiAccountScope(undefined);
    combinedMode$.next(true);
    activeAccount$ = new BehaviorSubject<{ id: UserId; email: string } | null>({
      id: userA,
      email: "a@example.com",
    });
    const accountService = mock<AccountService>();
    accountService.accounts$ = of({
      [userA]: { email: "a@example.com", name: "A" },
      [userB]: { email: "b@example.com", name: "B" },
    }) as unknown as AccountService["accounts$"];
    accountService.activeAccount$ =
      activeAccount$.asObservable() as unknown as AccountService["activeAccount$"];
    const authService = mock<AuthService>();
    authService.authStatuses$ = of({
      [userA]: AuthenticationStatus.Unlocked,
      [userB]: AuthenticationStatus.Unlocked,
    }) as unknown as AuthService["authStatuses$"];
    const avatarService = mock<AvatarService>();
    avatarService.getUserAvatarColor$.mockReturnValue(of(null));
    messagingService = mock<MessagingService>();
    messagingService.send.mockImplementation((command, data) => {
      if (command === "multiwardenActivateAccount") {
        const userId = (data as { userId: UserId }).userId;
        activeAccount$.next({ id: userId, email: `${userId}@example.com` });
      }
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: AuthService, useValue: authService },
        { provide: AvatarService, useValue: avatarService },
        { provide: MessagingService, useValue: messagingService },
      ],
    });
    service = TestBed.inject(MultiwardenCombinedService);
  });

  it("merges every unlocked account's items and keeps one copy of shared items", async () => {
    const items = await firstValueFrom(
      service.mergeForUsers((userId) =>
        of(userId === userA ? [{ id: "a1" }, { id: "shared" }] : [{ id: "b1" }, { id: "shared" }]),
      ),
    );

    expect(items.map((i) => i.id)).toEqual(["a1", "shared", "b1"]);
    expect(service.scope?.ownerOf("b1")).toBe(userB);
    expect(service.scope?.ownerOf("shared")).toBe(userA);
  });

  it("only uses the active account when combined mode is off", async () => {
    combinedMode$.next(false);

    const items = await firstValueFrom(
      service.mergeForUsers((userId) => of([{ id: `${userId}-item` }])),
    );

    expect(items.map((i) => i.id)).toEqual(["user-a-item"]);
  });

  it("activates the owning account before acting on an item", async () => {
    await firstValueFrom(service.mergeForUsers((userId) => of([{ id: `${userId}-item` }])));

    await service.prepareFor("user-b-item");

    expect(messagingService.send).toHaveBeenCalledWith("multiwardenActivateAccount", {
      userId: userB,
    });
    expect(activeAccount$.value?.id).toBe(userB);
  });

  it("does not switch accounts for an item of the active account", async () => {
    await firstValueFrom(service.mergeForUsers((userId) => of([{ id: `${userId}-item` }])));

    await service.prepareFor("user-a-item");

    expect(messagingService.send).not.toHaveBeenCalled();
  });
});
