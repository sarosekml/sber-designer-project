export type DecoratedValue = string | null;
export type RawValue = DecoratedValue | undefined;

export interface InputDecorator<TargetValue> {
  /**
   * Method which decorated value from external source in the start of component using
   */
  externalValueToDecorated: (value: TargetValue | null) => DecoratedValue;
  /**
   * Method which prepare decorated to real number to use it outside the component
   */
  valueFromDecorated: (value: DecoratedValue) => TargetValue | null;
  /**
   * Method which decorated user input "rawValue" to decorated view
   * */
  rawValueToDecorated: (rawValue: RawValue, selection?: number) => DecoratedValue;
  /**
   * Calculate current position for cursor from values
   */
  calcNewCursorPosition: (decoratedValue: DecoratedValue, rawValue: RawValue, selection: number) => number;
}
