import React from 'react';
import { StoryFn, Meta } from '@storybook/react';
import { Divider } from './Divider';
import { styled } from '@mui/material';
import MuiGrid from '@mui/material/Grid';

export default {
  title: 'Atoms/Divider',
  component: Divider,
} as Meta;

const Template: StoryFn<typeof Divider> = (args) => {
  const Grid = styled(MuiGrid)(({ theme }) => ({
    width: '100%',
    ...theme.typography.body2,
    '& [role="separator"]': {
      margin: theme.spacing(0, 2),
    },
  }));

  const content = (
    <div>
      {`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus id dignissim justo.
     Nulla ut facilisis ligula. Interdum et malesuada fames ac ante ipsum primis in faucibus.
     Sed malesuada lobortis pretium.`}
    </div>
  );
  return (
    <>
      {/* # Example № 1 */}
      <Grid container>
        <Grid>
          <Grid container>
            <Grid item lg={3} padding={3}>
              <h3>Lorem text №1</h3>
            </Grid>
            <Divider {...args} orientation="vertical" />
            <Grid item lg={3} padding={3}>
              <h3>Lorem text №2</h3>
            </Grid>
            <Divider {...args} orientation="vertical" />
            <Grid item lg={3} padding={3}>
              <h3>Lorem text №3</h3>
            </Grid>
            <Divider {...args} orientation="vertical" />
          </Grid>
        </Grid>

        <Grid>
          <h3>Lorem text row №4</h3>
        </Grid>

        <Grid>
          <Divider {...args} orientation="horizontal" />
        </Grid>

        <h3>Lorem text row №5</h3>
      </Grid>

      {/* # Example № 2 */}
      <Grid container border={'0.5px solid #B8CCCC'}>
        <Grid container flexDirection={'row'}>
          <Grid item xs padding={3}>
            {content}
          </Grid>
          <Divider {...args} orientation="vertical" />
          <Grid item xs padding={3}>
            {content}
          </Grid>
        </Grid>

        <Grid>
          <Divider {...args} orientation="horizontal" />
        </Grid>

        <Grid flexDirection={'row'} container>
          <Grid item xs padding={3}>
            {content}
          </Grid>
          <Divider {...args} orientation="vertical" />
          <Grid item xs padding={3}>
            {content}
          </Grid>
        </Grid>
      </Grid>
    </>
  );
};

export const Main = Template.bind({});
Main.args = {
  color: 'primary',
  flexItem: true,
};

Main.parameters = {
  docs: {
    description: {
      component: `### Divider \`horizontal\`:

  Для работы \`<Divider  orientation = horizontal .../>\` в родителе \`<Grid container>...</Grid>\`, т.е \`display: flex, flexDirection:\`row

 * Необходимо обернуть \`<Divider .../>\` в \`Grid\`. Пример \`<Grid><Divider orientation = horizontal ... /></Grid>\`

 * Либо использовать \`<Divider  orientation = horizontal .../>\` вне родителя с \`display: flex, flexDirection:row\` или использовать его в \`display: flex, flexDirection:\` column
### Divider \`vertical\`:

  Для работы \`<Divider  orientation = vertical .../>\` в родителе \`<Grid>...</Grid>\` или с \`display: flex, flexDirection:\`column

 * Необходимо обернуть \`<Divider .../>\` в \`Grid\`. Пример \`<Grid container>...<Divider orientation = vertical ... />.../Grid>\`

 * Либо использовать \`<Divider  orientation = vertical .../>\` вне родителя с \`display: flex, flexDirection:column\`, а с \`display: flex, flexDirection:\` row
`,
    },
  },
};
