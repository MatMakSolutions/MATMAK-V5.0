/**
 * Base abstract class for all path commands.
 */
export abstract class SvgCommand {
  constructor(
    public type: 'M' | 'L' | 'C' | 'Z',
    public relative: boolean
  ) { }
}
