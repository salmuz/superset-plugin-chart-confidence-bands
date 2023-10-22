export const convertInteger = (value: string | number) => {
  /**
   * This function is used to convert a string to an integer.
   */
  if (typeof value !== 'number') return parseInt(value, 10) || 0;
  return value;
};
