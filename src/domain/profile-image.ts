/** Starting palette for the animated glass card; it is not a place photograph. */
export function profileCardTheme(text: string) {
  if (
    /빈티지|패션|쇼핑|편집|의류|vintage|fashion|shopping|store|boutique|shop/i.test(
      text,
    )
  )
    return "shopping";
  if (
    /맛집|음식|카페|버거|타코|미식|식당|레스토랑|restaurant|burger|taco|cafe|food|dining/i.test(
      text,
    )
  )
    return "food";
  return "travel";
}
