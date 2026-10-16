import React from 'react';
import { Meta,StoryFn } from '@storybook/react';

import { theme } from '@/styles';

import { Link } from './Link';
import { LinkProps } from './Link.types';

export default {
  title: 'Atoms/Link/Link',
  component: Link,
  argTypes: {
    severity: { control: 'radio' },
    disabled: { control: 'boolean' },

    dataTestId: { table: { disable: true } },
    to: { table: { disable: true } },
    variant: { table: { disable: true } },
    underline: { table: { disable: true } },
    onClick: { table: { disable: true } },
    sx: { table: { disable: true } },
    TypographyClasses: { table: { disable: true } },
    classes: { table: { disable: true } },
    maxWidth: { table: { disable: true } },
    p: { table: { disable: true } },
    fontSize: { table: { disable: true } },
    height: { table: { disable: true } },
    width: { table: { disable: true } },
    display: { table: { disable: true } },
    fontFamily: { table: { disable: true } },
    fontWeight: { table: { disable: true } },
    letterSpacing: { table: { disable: true } },
    order: { table: { disable: true } },
    fontStyle: { table: { disable: true } },
    overflow: { table: { disable: true } },
    visibility: { table: { disable: true } },
    border: { table: { disable: true } },
    boxShadow: { table: { disable: true } },
    zIndex: { table: { disable: true } },
    alignContent: { table: { disable: true } },
    alignItems: { table: { disable: true } },
    boxSizing: { table: { disable: true } },
    bottom: { table: { disable: true } },
    columnGap: { table: { disable: true } },
    flexBasis: { table: { disable: true } },
    flexDirection: { table: { disable: true } },
    flexGrow: { table: { disable: true } },
    flexShrink: { table: { disable: true } },
    flexWrap: { table: { disable: true } },
    gridAutoColumns: { table: { disable: true } },
    gridAutoFlow: { table: { disable: true } },
    gridAutoRows: { table: { disable: true } },
    gridTemplateAreas: { table: { disable: true } },
    gridTemplateColumns: { table: { disable: true } },
    alignSelf: { table: { disable: true } },
    justifyContent: { table: { disable: true } },
    justifyItems: { table: { disable: true } },
    left: { table: { disable: true } },
    lineHeight: { table: { disable: true } },
    marginBottom: { table: { disable: true } },
    marginLeft: { table: { disable: true } },
    marginRight: { table: { disable: true } },
    marginTop: { table: { disable: true } },
    maxHeight: { table: { disable: true } },
    minHeight: { table: { disable: true } },
    minWidth: { table: { disable: true } },
    paddingBottom: { table: { disable: true } },
    paddingLeft: { table: { disable: true } },
    paddingRight: { table: { disable: true } },
    paddingTop: { table: { disable: true } },
    position: { table: { disable: true } },
    right: { table: { disable: true } },
    rowGap: { table: { disable: true } },
    textAlign: { table: { disable: true } },
    textOverflow: { table: { disable: true } },
    textTransform: { table: { disable: true } },
    top: { table: { disable: true } },
    whiteSpace: { table: { disable: true } },
    borderBottom: { table: { disable: true } },
    borderColor: { table: { disable: true } },
    borderLeft: { table: { disable: true } },
    borderRadius: { table: { disable: true } },
    gridTemplateRows: { table: { disable: true } },
    justifySelf: { table: { disable: true } },
    borderTop: { table: { disable: true } },
    flex: { table: { disable: true } },
    gap: { table: { disable: true } },
    gridArea: { table: { disable: true } },
    gridColumn: { table: { disable: true } },
    gridRow: { table: { disable: true } },
    margin: { table: { disable: true } },
    padding: { table: { disable: true } },
    bgcolor: { table: { disable: true } },
    m: { table: { disable: true } },
    mt: { table: { disable: true } },
    mr: { table: { disable: true } },
    mx: { table: { disable: true } },
    marginX: { table: { disable: true } },
    marginY: { table: { disable: true } },
    pt: { table: { disable: true } },
    pr: { table: { disable: true } },
    pb: { table: { disable: true } },
    pl: { table: { disable: true } },
    px: { table: { disable: true } },
    paddingX: { table: { disable: true } },
    py: { table: { disable: true } },
    paddingY: { table: { disable: true } },
    typography: { table: { disable: true } },
    mb: { table: { disable: true } },
    ml: { table: { disable: true } },
    my: { table: { disable: true } },
    displayPrint: { table: { disable: true } },
    align: { table: { disable: true } },
    gutterBottom: { table: { disable: true } },
    noWrap: { table: { disable: true } },
    paragraph: { table: { disable: true } },
    variantMapping: { table: { disable: true } },
    color: { table: { disable: true } },
    borderRight: { table: { disable: true } },
  },
} as Meta<typeof Link>;

const Template: StoryFn<typeof Link> = (args) => <Link {...args} />;

const SeverityTemplate: StoryFn<typeof Link> = (args) => {
  const severities: LinkProps['severity'][] = [
    'default',
    'success',
    'info',
    'warning',
    'error',
    'breadcrumbs1',
    'breadcrumbs2',
  ];

  return (
    <table
      style={{
        fontSize: theme.typography.BodySStrongSmb.fontSize,
        borderSpacing: theme.spacing(4, 2),
        width: '100%',
        fontWeight: 700,
        textTransform: 'capitalize',
      }}
    >
      <thead style={{ textAlign: 'left' }}>
        <tr>
          <th />
          {severities.map((severity) => (
            <th key={severity} style={{ width: '150px' }}>
              {severity}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        <tr>
          <td style={{ textAlign: 'right', height: '50px' }}>default</td>
          {severities.map((severity) => (
            <td key={severity}>
              <Link {...args} severity={severity} />
            </td>
          ))}
        </tr>

        <tr>
          <td style={{ textAlign: 'right', height: '50px' }}>disabled</td>
          {severities.map((severity) => (
            <td key={severity}>
              <Link {...args} disabled severity={severity} />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
};

export const AMain = Template.bind({});
AMain.args = {
  dataTestId: 'stories',
  to: '#',
  disabled: false,
  onClick: () => {},
  children: 'Link',
} as LinkProps;

export const BSeverity = SeverityTemplate.bind({});
BSeverity.args = {
  ...AMain.args,
} as LinkProps;

BSeverity.argTypes = {
  severity: { table: { disable: true } },
};
