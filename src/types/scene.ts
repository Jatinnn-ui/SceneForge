/** Shared data contract. Runtime validation lives in ../store.js. */
export type ObjectType = 'tree' | 'pine_tree' | 'rock' | 'house' | 'tent' | 'campfire' | 'bridge' | 'river' | 'mountain' | 'tower' | 'road' | 'cloud';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog';
export type TimeOfDay = 'morning' | 'afternoon' | 'sunset' | 'night';
export interface SceneObject { id: string; type: ObjectType; position: [number, number, number]; scale: number; }
export interface Scene { name: string; objects: SceneObject[]; environment: { weather: Weather; time: TimeOfDay }; }
export interface CommandHistoryEntry { command: string; message: string; }
export type SceneOperation =
  | { type: 'create_object'; object: SceneObject }
  | { type: 'delete_object'; id: string }
  | { type: 'move_object'; id: string; position: [number, number, number] }
  | { type: 'change_weather'; weather: Weather }
  | { type: 'change_time'; time: TimeOfDay }
  | { type: 'query_scene'; objectType?: ObjectType };
