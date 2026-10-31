import { requireOptionalNativeModule } from "expo-modules-core";

/** Lo nativo de Android (widget, registro rápido, notificaciones). null fuera de Android. */
interface WastedAndroidModule {
  configure(apiUrl: string): void;
  getKey(): string | null;
  setKey(key: string | null): void;
  refreshWidget(): void;
  hasNotificationAccess(): boolean;
  readNotifications(): boolean;
  setReadNotifications(read: boolean): void;
  installedPayApps(): string[];
  openNotificationSettings(): void;
  openAppDetails(): void;
  openQuickAdd(): void;
}

export const WastedAndroid = requireOptionalNativeModule<WastedAndroidModule>("WastedAndroid");
