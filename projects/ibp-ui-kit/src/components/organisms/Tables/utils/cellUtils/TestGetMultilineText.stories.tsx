import React from 'react';
import { StoryObj } from '@storybook/react';

import { getMultilineText } from './textPresenters';

const TestStory = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h4>Test 1: Long text (should show tooltip)</h4>
      <div style={{ width: '100px', border: '1px solid red', marginBottom: '20px' }}>
        {getMultilineText({
          value: ['Очень длинный текст для проверки тултипа который точно не поместится в 100px'],
        })}
      </div>

      <h4>Test 2: Short text (no tooltip)</h4>
      <div style={{ width: '300px', border: '1px solid green', marginBottom: '20px' }}>
        {getMultilineText({ value: ['Короткий'] })}
      </div>

      <h4>Test 3: Multiple lines</h4>
      <div style={{ width: '150px', border: '1px solid blue' }}>
        {getMultilineText({
          value: ['Первая строка', 'Вторая строка', 'Третья строка'],
        })}
      </div>
    </div>
  );
};

export default {
  title: 'Utils/getMultilineText Test',
  component: TestStory,
};

export const Default: StoryObj = {
  render: () => <TestStory />,
};
