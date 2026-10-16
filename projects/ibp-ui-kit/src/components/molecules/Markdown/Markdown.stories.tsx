import { Meta, StoryObj } from '@storybook/react';

import { Markdown } from './Markdown';

const meta: Meta<typeof Markdown> = {
  title: 'Markdown',
  component: Markdown,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    children: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof Markdown>;

export const Latex: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Компонент для отображения в разметке markdown. Markdown поддерживает так же LaTeX формат и разметку листинга кода.',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    children: `## Формулы LaTeX

### Общая запись
Для написания в формате LaTeX используйте символы &#36;&#36; до и после LaTeX выражения. В качестве онлайн конвертера можете использовать [этот ресурс](https://latexeditor.lagrida.com/).

#### Неравенство Коши - Буняковского
$$\\left( \\sum_{k=1}^n a_k b_k \\right)^2 \\leq \\left( \\sum_{k=1}^n a_k^2 \\right) \\left( \\sum_{k=1}^n b_k^2 \\right)$$
\n
\`\`\`
\\left( \\sum_{k=1}^n a_k b_k \\right)^2 \\leq \\left( \\sum_{k=1}^n a_k^2 \\right) \\left( \\sum_{k=1}^n b_k^2 \\right)
\`\`\`


### Inline выражение
Для инлайн выражений нужно обрамить latex выражение в знаки доллара: $\\sqrt{4}$
\`\`\`
\\sqrt{4}
\`\`\``,
  },
};

export const Code: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Компонент для отображения в разметке markdown. Markdown поддерживает так же LaTeX формат и разметку листинга кода.',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    children: `## Разметка кода
### Javascript
\`\`\`javascript
function solveQuadratic(a, b, c) {
    // Вычисляем дискриминант
    const discriminant = b ** 2 - 4 * a * c;
    
    if (discriminant > 0) {
        // Два различных действительных корня
        const root1 = (-b + Math.sqrt(discriminant)) / (2 * a);
        const root2 = (-b - Math.sqrt(discriminant)) / (2 * a);
        
        return \`Корни уравнения: \${root1}, \${root2}\`;
    } else if (discriminant === 0) {
        // Один действительный корень
        const root = -b / (2 * a);
        
        return \`Уравнение имеет один корень: \${root}\`;
    } else {
        // Комплексные корни
        const realPart = -b / (2 * a);
        const imaginaryPart = Math.sqrt(-discriminant) / (2 * a);
        
        return \`Комплексные корни: \${realPart}+\${imaginaryPart}i и \${realPart}-\${imaginaryPart}i\`;
    }
}
\`\`\`

## Rust
\`\`\`rust
use std::f64;

fn main() {
    let a = 1.0; // Коэффициент при x^2
    let b = -3.0; // Коэффициент при x
    let c = 2.0; // Свободный член

    match solve_quadratic(a, b, c) {
        Some((x1, x2)) => println!("Корни уравнения: {} и {}", x1, x2),
        None => println!("Нет действительных корней"),
    };
}

fn solve_quadratic(a: f64, b: f64, c: f64) -> Option<(f64, f64)> {
    let discriminant = b.powi(2) - 4.0 * a * c;

    if discriminant > 0.0 {
        let sqrt_d = discriminant.sqrt();
        let x1 = (-b + sqrt_d) / (2.0 * a);
        let x2 = (-b - sqrt_d) / (2.0 * a);
        Some((x1, x2))
    } else if discriminant == 0.0 {
        let x = -b / (2.0 * a);
        Some((x, x))
    } else {
        None
    }
}
\`\`\`
`,
  },
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Компонент для отображения в разметке markdown. Markdown поддерживает так же LaTeX формат и разметку листинга кода.',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    children: `# Базовый синтаксис

## Заголовки

Чтобы создать заголовок, добавьте от одного до шести символов # перед его текстом. Количество используемых # элементов определяет уровень иерархии и размер шрифта заголовка.
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
\`\`\`
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
\`\`\`

## Текст стилей

Текст в полях комментариев и файлах .md можно выделять полужирным шрифтом, курсивом, зачеркиванием, а также подстрочным или надстрочным шрифтом.

| Стиль | Синтаксис | Горячие клавиши | Пример | Результат |
| --- | --- | --- | --- | --- |
| Жирный | \`** **\` or \`__ __\`| <kbd>Command</kbd>+<kbd>B</kbd> (Mac) or <kbd>Ctrl</kbd>+<kbd>B</kbd> (Windows/Linux) | \`**This is bold text**\` | **This is bold text** |
| Курсив | \`* *\` or \`_ _\` | <kbd>Command</kbd>+<kbd>I</kbd> (Mac) or <kbd>Ctrl</kbd>+<kbd>I</kbd> (Windows/Linux) | \`_This text is italicized_\` | _This text is italicized_ |
| Зачеркивание | \`~~ ~~\` | None | \`~~This was mistaken text~~\` | ~~This was mistaken text~~ |
| Жирный с частичным курсивом | \`** **\` and \`_ _\` | None | \`**This text is _extremely_ important**\` | **This text is _extremely_ important** |
| Все жирное с курсивом | \`*** ***\` | None | \`***All this text is important***\` | ***All this text is important*** | <!-- markdownlint-disable-line emphasis-style -->
| Подстрочный | \`<sub> </sub>\` | None | \`This is a <sub>subscript</sub> text\` | This is a <sub>subscript</sub> text |
| Надстрочный | \`<sup> </sup>\` | None | \`This is a <sup>superscript</sup> text\` | This is a <sup>superscript</sup> text |
| Нижнее подчеркивание | \`<ins> </ins>\` | None | \`This is an <ins>underlined</ins> text\` | This is an <ins>underlined</ins> text |

## Цитирование текста

Вы можете цитировать текст:

Этот текст без цитирования

> Этот текст с цитированием
\`\`\`markdown
Этот текст без цитирования

> Этот текст с цитированием
\`\`\`

## Ссылки

Вы можете создать встроенную ссылку, заключив текст ссылки в скобки \`[ ]\`, и затем заключите URL в скобки \`()\`. 

Это [Яндекс](https://yandex.ru).

\`\`\`markdown
Это [Яндекс](https://yandex.ru).
\`\`\`


## Ссылки на разделы

Если вам нужно определить якорь для заголовка в редактируемом файле, вы можете использовать следующие основные правила:

* Буквы преобразуются в строчные.
* Пробелы заменяются дефисами (\` - \`). Все остальные пробелы или знаки препинания удаляются.
* Начальные и конечные пробелы удаляются.
* Форматирование разметки удаляется, остается только содержимое (например, \`_italics_\` становится \`italics\`).
* Если автоматически сгенерированный якорь для заголовка идентичен более раннему якорю в том же документе, уникальный идентификатор генерируется путем добавления дефиса и автоинкрементного целого числа.

Более подробную информацию о требованиях к фрагментам URI см. [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986#section-3.5).

Приведенный ниже блок кода демонстрирует основные правила, используемые для генерации якорей из заголовков в отображаемом контенте.

## Относительные ссылки

### Пользовательские якоря

Вы можете использовать стандартный HTML якоря (\`<a name="unique-anchor-name"></a>\`) для создания точек навигации по документу.

> Пользовательские якоря не будут включены в документ.

Вы можете ссылаться на пользовательский якорь, используя значение атрибута \`\`, который вы дали якорь.Синтаксис точно такой же, как и когда вы ссылаетесь на якорь, который автоматически генерируется для заголовка.

Например:
### Заголовок секции
Некоторый текст тела этого раздела.
<a name="my-custom-anchor-point"></a>
Текст, на который я хочу предоставить прямую ссылку, но у которого нет своего заголовка.

[Ссылка на этот пользовательский якорь](#my-custom-anchor-point)

\`\`\`markdown
### Заголовок секции
Некоторый текст тела этого раздела.
<a name="my-custom-anchor-point"></a>
Текст, на который я хочу предоставить прямую ссылку, но у которого нет своего заголовка.

[Ссылка на этот пользовательский якорь](#my-custom-anchor-point)
\`\`\`

> Пользовательские якоря не рассматриваются путем автоматического поведения именования и нумерации автоматических направлений заголовка.

## Списки

Вы можете составить неупорядоченный список, пометьте каждый элемент списка символов <kbd>-</kbd>, <kbd>*</kbd>, или <kbd>+</kbd>.

- Иванов Иван
* Иван Иванов
+ Иванович Иван

\`\`\`markdown
- Иванов Иван
* Иван Иванов
+ Иванович Иван
\`\`\`

Чтобы разметки своего списка, пометьте каждую строку своего текста порядковым номером.

1. Иванов Иван
2. Иван Иванов
3. Иванович Иван

\`\`\`markdown
1. Иванов Иван
2. Иван Иванов
3. Иванович Иван
\`\`\`

### Вложенные списки

Вы можете создать вложенный список, рассмотрев один или несколько элементов списка ниже другого элемента.

1. Первый список
   - Первый вложенный список списка
     - Второй вложенный список списка

\`\`\`markdown
1. Первый список
   - Первый вложенный список списка
     - Второй вложенный список списка
\`\`\`
`,
  },
};
