import { invoke } from "@tauri-apps/api/core";
import type { UserTemplateFiles } from "$lib/templates/user";

export function listUserTemplates(): Promise<UserTemplateFiles[]> {
  return invoke<UserTemplateFiles[]>("list_user_templates");
}

/** Returns the id actually used: `baseId`, or `baseId-2`… if that is taken. */
export function createUserTemplate(baseId: string, json: string, css: string): Promise<string> {
  return invoke<string>("create_user_template", { baseId, json, css });
}

export function importTemplateCss(path: string): Promise<string> {
  return invoke<string>("import_template_css", { path });
}

export function deleteUserTemplate(id: string): Promise<void> {
  return invoke("delete_user_template", { id });
}

export function openTemplatesFolder(): Promise<void> {
  return invoke("open_templates_folder");
}

export function watchTemplates(): Promise<void> {
  return invoke("watch_templates");
}
