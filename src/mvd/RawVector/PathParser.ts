const kCommandTypeRegex = /^[\t\n\f\r ]*([MLHVZCSQTAmlhvzcsqta])[\t\n\f\r ]*/;
const kFlagRegex        = /^[01]/;
const kNumberRegex      = /^[+-]?(([0-9]*\.[0-9]+)|([0-9]+\.)|([0-9]+))([eE][+-]?[0-9]+)?/;
const kCoordinateRegex  = kNumberRegex;
const kCommaWsp         = /^(([\t\n\f\r ]+,?[\t\n\f\r ]*)|(,[\t\n\f\r ]*))/;

const kGrammar: {[key: string]: RegExp[]}  = {
    M: [kCoordinateRegex, kCoordinateRegex],
    L: [kCoordinateRegex, kCoordinateRegex],
    H: [kCoordinateRegex],
    V: [kCoordinateRegex],
    Z: [],
    C: [kCoordinateRegex, kCoordinateRegex, kCoordinateRegex, kCoordinateRegex, kCoordinateRegex, kCoordinateRegex],
    S: [kCoordinateRegex, kCoordinateRegex, kCoordinateRegex, kCoordinateRegex],
    Q: [kCoordinateRegex, kCoordinateRegex, kCoordinateRegex, kCoordinateRegex],
    T: [kCoordinateRegex, kCoordinateRegex],
    A: [kNumberRegex, kNumberRegex, kCoordinateRegex, kFlagRegex, kFlagRegex, kCoordinateRegex, kCoordinateRegex],
};

/**
 * Parses an path string into an array of path commands and their corresponding parameters.
 */
export class PathParser {

    /**
   * Extracts the components of a path command from a path string.
   * @param type - The type of the path command.
   * @param path - The path string to extract the components from.
   * @param cursor - The current position in the path string.
   * @returns A tuple containing the new cursor position and an array of components for the path command.
   * @throws An error if the path string is malformed.
   */
    static components(type: string, path: string, cursor: number): [number, string[][]]
    {
        const expectedRegexList = kGrammar[type.toUpperCase()];

        const components: string[][] = [];
        while (cursor <= path.length) {
            const component: string[] = [type];
            for (const regex of expectedRegexList) {
                const match = path.slice(cursor).match(regex);

                if (match !== null) {
                    component.push(match[0]);
                    cursor += match[0].length;
                    const ws = path.slice(cursor).match(kCommaWsp);
                    if (ws !== null) {
                        cursor += ws[0].length;
                    }
                } else if (component.length === 1) {
                    return [cursor, components];
                } else {
                    throw new Error('malformed path (first error at ' + cursor + ')');
                }
            }
            components.push(component);
            if (expectedRegexList.length === 0) {
                return [cursor, components];
            }
            if (type === 'm') {
                type = 'l';
            }
            if (type === 'M') {
                type = 'L';
            }
        }
        throw new Error('malformed path (first error at ' + cursor + ')');
    }

      /**
   * Parses an path string into an array of path commands and their corresponding parameters.
   * @param path - The path string to parse.
   * @returns An array of path commands and their corresponding parameters.
   * @throws An error if the path string is malformed.
   */
    public static parse(path: string): string[][] {
        let cursor = 0;
        let tokens: string[][] = [];
        while (cursor < path.length) {
            const match = path.slice(cursor).match(kCommandTypeRegex);
            if (match !== null) {
                const command = match[1];
                cursor += match[0].length;
                const componentList = PathParser.components(command, path, cursor);
                cursor = componentList[0];
                tokens = [...tokens, ...componentList[1]];
            } else {
                throw new Error('malformed path (first error at ' + cursor + ')');
            }
        }
        return tokens;
    }
}