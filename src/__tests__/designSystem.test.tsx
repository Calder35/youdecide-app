import { fireEvent, render, screen } from '@testing-library/react-native';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { ConsentItem } from '../components/ConsentItem';
import { Disclosure } from '../components/Disclosure';
import { ErrorBanner, InlineError } from '../components/Errors';
import { Field } from '../components/Field';
import { Figure } from '../components/Figure';
import { CONSENTS } from '../data/consents';
import { validateEmail } from '../data/validation';
import { sourced } from '../data/types';

describe('Button', () => {
  it('reports its disabled state and says why', async () => {
    const onPress = jest.fn();
    await render(
      <Button
        label="Continue"
        onPress={onPress}
        disabled
        disabledReason="Still needed: the two required agreements"
        testID="cta"
      />,
    );

    await fireEvent.press(screen.getByTestId('cta'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('cta')).toBeDisabled();
    // A dead button is never a mystery.
    expect(screen.getByTestId('cta-reason')).toHaveTextContent(/Still needed/);
  });

  it('blocks presses while busy and announces it', async () => {
    const onPress = jest.fn();
    await render(<Button label="Sending" onPress={onPress} busy testID="cta" />);
    await fireEvent.press(screen.getByTestId('cta'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('cta')).toBeBusy();
  });

  it('presses when it is live', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} testID="cta" />);
    await fireEvent.press(screen.getByTestId('cta'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Field', () => {
  it('stays quiet while the seller is still typing', async () => {
    await render(
      <Field
        label="Email"
        value="jordan@"
        onChangeText={jest.fn()}
        validate={validateEmail}
        testID="field-email"
      />,
    );
    expect(screen.queryByTestId('field-email-error')).toBeNull();
  });

  it('explains the problem once they move on', async () => {
    await render(
      <Field
        label="Email"
        value="jordan@"
        onChangeText={jest.fn()}
        validate={validateEmail}
        testID="field-email"
      />,
    );
    await fireEvent(screen.getByTestId('field-email'), 'blur');
    expect(screen.getByTestId('field-email-error')).toHaveTextContent(/missing @ or a typo/);
    // The error is part of what a screen reader announces for the input, and
    // the input itself reports that it is invalid.
    expect(screen.getByTestId('field-email')).toHaveProp('aria-invalid', true);
    expect(screen.getByTestId('field-email').props.accessibilityHint).toMatch(/missing @/);
  });

  it('clears the error when the value becomes valid', async () => {
    const { rerender } = await render(
      <Field
        label="Email"
        value="jordan@"
        onChangeText={jest.fn()}
        validate={validateEmail}
        testID="field-email"
      />,
    );
    await fireEvent(screen.getByTestId('field-email'), 'blur');
    expect(screen.queryByTestId('field-email-error')).not.toBeNull();

    await rerender(
      <Field
        label="Email"
        value="jordan@example.com"
        onChangeText={jest.fn()}
        validate={validateEmail}
        testID="field-email"
      />,
    );
    expect(screen.queryByTestId('field-email-error')).toBeNull();
  });
});

describe('Errors', () => {
  it('announces an inline error to a screen reader', async () => {
    await render(<InlineError message="Add an area code." testID="err" />);
    expect(screen.getByTestId('err')).toHaveProp('accessibilityRole', 'alert');
    expect(screen.getByText('Add an area code.')).toBeOnTheScreen();
  });

  it('announces a banner error too', async () => {
    await render(
      <ErrorBanner title="We could not reach an agent" message="Try again in a minute." testID="banner" />,
    );
    expect(screen.getByTestId('banner')).toHaveProp('accessibilityRole', 'alert');
    expect(screen.getByText('Try again in a minute.')).toBeOnTheScreen();
  });
});

describe('Disclosure', () => {
  it('hides its body until asked, and reports which state it is in', async () => {
    await render(
      <Disclosure summary="Why are you asking?" testID="why">
        <AppText>Because the paperwork needs it.</AppText>
      </Disclosure>,
    );

    expect(screen.queryByText('Because the paperwork needs it.')).toBeNull();
    expect(screen.getByTestId('why')).not.toBeExpanded();

    await fireEvent.press(screen.getByTestId('why'));
    expect(screen.getByText('Because the paperwork needs it.')).toBeOnTheScreen();
    expect(screen.getByTestId('why')).toBeExpanded();
  });
});

describe('ConsentItem', () => {
  const terms = CONSENTS[0];

  it('keeps the thing being agreed to on screen, not behind a link', async () => {
    await render(
      <ConsentItem consent={terms} checked={false} onToggle={jest.fn()} testID="consent" />,
    );
    expect(screen.getByText(terms.body)).toBeOnTheScreen();
  });

  it('labels required and optional in words', async () => {
    await render(
      <ConsentItem consent={terms} checked={false} onToggle={jest.fn()} testID="consent" />,
    );
    expect(screen.getByTestId('consent-requirement')).toHaveTextContent('Required');
  });

  it('says what happens if the seller declines', async () => {
    await render(
      <ConsentItem consent={terms} checked={false} onToggle={jest.fn()} testID="consent" />,
    );
    await fireEvent.press(screen.getByTestId('consent-why'));
    expect(screen.getByText(terms.ifDeclined)).toBeOnTheScreen();
  });

  it('behaves as a checkbox', async () => {
    const onToggle = jest.fn();
    await render(
      <ConsentItem consent={terms} checked onToggle={onToggle} testID="consent" />,
    );
    expect(screen.getByTestId('consent')).toBeChecked();
    await fireEvent.press(screen.getByTestId('consent'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('Figure', () => {
  it('cannot show a value without its source and confidence', async () => {
    await render(
      <Figure
        label="Estimated sale price"
        value={sourced('$438,000 – $466,000', '7 comparable sales nearby', 'medium', '2026-08-14')}
        testID="fig"
      />,
    );

    expect(screen.getByText('$438,000 – $466,000')).toBeOnTheScreen();
    expect(screen.getByText(/Medium confidence/)).toBeOnTheScreen();
    expect(screen.getByText(/7 comparable sales nearby/)).toBeOnTheScreen();
    expect(screen.getByText(/as of 2026-08-14/)).toBeOnTheScreen();
  });

  it('explains what the confidence level means when asked', async () => {
    await render(
      <Figure
        label="HOA dues"
        value={sourced('About $65 / month', 'Listing history for this subdivision', 'low')}
        testID="fig"
      />,
    );
    await fireEvent.press(screen.getByTestId('fig-meaning'));
    expect(screen.getByText(/rough starting point/i)).toBeOnTheScreen();
  });

  it('marks a figure the seller corrected', async () => {
    await render(
      <Figure
        label="Living area"
        value={sourced('2,410 sq ft', 'Clark County Assessor record', 'high')}
        correctedBySeller
        testID="fig"
      />,
    );
    expect(screen.getByText('You corrected this')).toBeOnTheScreen();
  });
});

/**
 * The design system is only a system if screens actually go through it.
 */
describe('design-system adoption', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
  }

  it('routes all text through AppText rather than raw react-native Text', () => {
    const allowed = new Set(['src/components/AppText.tsx']);
    const offenders = [...sourceFiles('src/screens'), ...sourceFiles('src/components')]
      .filter((file) => !allowed.has(file))
      .filter((file) => /import\s*\{[^}]*\bText\b[^}]*\}\s*from\s*'react-native'/.test(
        readFileSync(file, 'utf8'),
      ));

    expect(offenders).toEqual([]);
  });

  it('keeps hard-coded colors out of screens — tokens only', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles('src/screens')) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (/#[0-9a-fA-F]{3,8}\b/.test(line)) offenders.push(`${file}:${index + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
