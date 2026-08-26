import type { DslNodeDeclaration } from './component.ts';

function quote(value: string): string { return `"${value}"`; }

/** Creates the existing `keyword name [description]` declaration without duplicating grammar. */
export function namedNodeDeclaration(
  keyword: string,
  exampleLabel: string,
  exampleDescription?: string,
): DslNodeDeclaration {
  const syntax = `${keyword} "name" ["optional description"]`;
  const example = `${keyword} ${quote(exampleLabel)}`
    + `${exampleDescription ? ` ${quote(exampleDescription)}` : ''}`;
  return {
    syntax, example, allowsBody: true,
    parse(tokens) {
      if (tokens.length < 2) return { error: `${keyword} needs a name`, hint: example };
      return { label: tokens[1], ...(tokens[2] === undefined ? {} : { description: tokens[2] }) };
    },
    print(node) {
      return `${keyword} ${quote(node.label)}${node.description ? ` ${quote(node.description)}` : ''}`;
    },
  };
}

/** Creates a text-only declaration such as `note`; it cannot own nested DSL lines. */
export function textNodeDeclaration(keyword: string, exampleText: string): DslNodeDeclaration {
  const syntax = `${keyword} "text"`;
  const example = `${keyword} ${quote(exampleText)}`;
  return {
    syntax, example, allowsBody: false,
    parse(tokens) {
      if (tokens.length < 2) return { error: `${keyword} needs text`, hint: example };
      return { label: tokens[1] };
    },
    print(node) { return `${keyword} ${quote(node.label)}`; },
  };
}
