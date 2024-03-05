export type Branding = {
  name: string | null;
  appearance: string;
  border_radius: string;
  light_mode: {
    logo: string | null;
    favicon: string | null;
    page_background: string;
    button_background: string;
    button_text: string;
    links: string;
  };
  dark_mode: {
    logo: string | null;
    favicon: string | null;
    page_background: string;
    button_background: string;
    button_text: string;
    links: string;
  };
};

export type Filter = Omit<WeaviateFilter, 'operands' | 'path'> & {
  conditions?: Filter[];
  property?: string[];
};

export type WeaviateFilter = {
  operands?: WeaviateFilter[];
  path?: string[];
  operator?:
    | 'And'
    | 'Or'
    | 'Equal'
    | 'Like'
    | 'NotEqual'
    | 'GreaterThan'
    | 'GreaterThanEqual'
    | 'LessThan'
    | 'LessThanEqual'
    | 'IsNull'
    | 'ContainsAny'
    | 'ContainsAll';
  valueInt?: number;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueString?: string;
  valueText?: string;
  valueDate?: string;
  valueIntArray?: number[];
  valueNumberArray?: number[];
  valueBooleanArray?: boolean[];
  valueStringArray?: string[];
  valueTextArray?: string[];
  valueDateArray?: string[];
};
