/** Semantic values shared by legacy documents and current diagram records. */
export interface CanvasReference { namespace: string; id: string }
export interface SourceReference extends CanvasReference { label?: string }

/** One selectable interface exposed by a node. */
export interface InterfaceObject {
  id: string;
  ownerId: string;
  name: string;
  accepts: string[];
  returns: string[];
}

/** One selectable shared type definition. */
export interface TypeObject { id: string; name: string; fields: string[] }
