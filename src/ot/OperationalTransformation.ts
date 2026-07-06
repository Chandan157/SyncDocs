export type OpType = 'insert' | 'delete' | 'replace';

export interface Operation {
  type: OpType;
  position: number;
  text?: string;
  length?: number;
}

export interface ClientOperation {
  revision: number;
  operation: Operation;
  clientId: string;
}

export class OTEngine {
  // Transform op1 against op2. 
  // Modifies op1 in place or returns a new operation based on the conflict with op2.
  static transform(op1: Operation, op2: Operation): Operation {
    let transformed: Operation = { ...op1 };

    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position >= op2.position) {
        transformed.position += (op2.text?.length || 0);
      }
    } else if (op1.type === 'insert' && op2.type === 'delete') {
      if (op1.position > op2.position) {
        transformed.position = Math.max(op2.position, op1.position - (op2.length || 0));
      }
    } else if (op1.type === 'delete' && op2.type === 'insert') {
      if (op1.position >= op2.position) {
        transformed.position += (op2.text?.length || 0);
      } else if (op1.position + (op1.length || 0) > op2.position) {
        // Complex overlap, simple split/shift for now
        transformed.length = (transformed.length || 0) + (op2.text?.length || 0);
      }
    } else if (op1.type === 'delete' && op2.type === 'delete') {
      if (op1.position >= op2.position) {
        const overlap = Math.max(0, Math.min(op1.length || 0, (op2.length || 0) - (op1.position - op2.position)));
        transformed.position = Math.max(op2.position, op1.position - (op2.length || 0));
        transformed.length = (transformed.length || 0) - overlap;
      } else if (op1.position + (op1.length || 0) > op2.position) {
        transformed.length = (transformed.length || 0) - Math.min((transformed.length || 0) - (op2.position - op1.position), (op2.length || 0));
      }
    } else if (op1.type === 'replace') {
      // Basic replace transformation
      if (op2.type === 'insert' && op1.position >= op2.position) {
        transformed.position += (op2.text?.length || 0);
      } else if (op2.type === 'delete' && op1.position >= op2.position) {
        transformed.position = Math.max(op2.position, op1.position - (op2.length || 0));
      }
    }
    
    return transformed;
  }

  // Apply an operation to a canonical document string
  static apply(document: string, op: Operation): string {
    if (op.type === 'insert') {
      return document.slice(0, op.position) + (op.text || '') + document.slice(op.position);
    } else if (op.type === 'delete') {
      return document.slice(0, op.position) + document.slice(op.position + (op.length || 0));
    } else if (op.type === 'replace') {
      return document.slice(0, op.position) + (op.text || '') + document.slice(op.position + (op.length || 0));
    }
    return document;
  }
}
