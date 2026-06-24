"use client";

/**
 * Intentional shadcn-named aliases over Kumo's `Combobox`. This file lets the
 * ~15 existing `Command*` call sites keep the familiar cmdk/shadcn naming while
 * rendering Kumo's `Combobox` underneath — it is not an orphan or dead shim, so
 * do not delete it. Add new aliases here as more Combobox parts are needed.
 */
import { Combobox } from "@cloudflare/kumo/components/combobox";

export const Command = Combobox;
export const CommandInput = Combobox.TriggerInput;
export const CommandList = Combobox.List;
export const CommandGroup = Combobox.Group;
export const CommandItem = Combobox.Item;
export const CommandEmpty = Combobox.Empty;
