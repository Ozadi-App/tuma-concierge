import { DOOR_SLUG, type DoorId } from "./door-ids";

/** The address of a sub-feature page: /buy/stores, /ride/boda, /work/clean. */
export const subPath = (door: DoorId, key: string) => `/${DOOR_SLUG[door]}/${key}`;
