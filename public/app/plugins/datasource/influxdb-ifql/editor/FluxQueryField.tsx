// import React from 'react';
import Plain from 'slate-plain-serializer';

import QueryField, { getInitialValue, TYPEAHEAD_DEBOUNCE } from 'app/containers/Explore/QueryField';
import debounce from 'app/containers/Explore/utils/debounce';
import { getNextCharacter, getPreviousCousin } from 'app/containers/Explore/utils/dom';

import { FUNCTIONS } from './flux';

const cleanText = s => s.replace(/[{}[\]="(),!~+\-*/^%]/g, '').trim();
const RATE_RANGES = ['1m', '5m', '10m', '30m', '1h'];
const EMPTY_METRIC = '';

export default class FluxQueryField extends QueryField {
  componentDidMount() {
    this.updateMenu();
    // TODO fetch measurements
  }

  componentWillReceiveProps(nextProps) {
    // initialQuery is null in case the user typed
    if (nextProps.initialQuery !== null && nextProps.initialQuery !== this.props.initialQuery) {
      this.setState({ value: getInitialValue(nextProps.initialQuery) });
    }
  }

  handleTypeahead = debounce(() => {
    const selection = window.getSelection();
    if (selection.anchorNode) {
      const wrapperNode = selection.anchorNode.parentElement;
      const editorNode = wrapperNode.closest('.slate-query-field');
      if (!editorNode || this.state.value.isBlurred) {
        // Not inside this editor
        return;
      }

      // DOM ranges
      const range = selection.getRangeAt(0);
      const text = selection.anchorNode.textContent;
      const offset = range.startOffset;
      const prefix = cleanText(text.substr(0, offset));

      // Model ranges
      const modelOffset = this.state.value.anchorOffset;
      const modelPrefix = this.state.value.anchorText.text.slice(0, modelOffset);

      // Determine candidates by context
      const suggestionGroups = [];
      const wrapperClasses = wrapperNode.classList;
      let typeaheadContext = null;

      // Take first metric as lucky guess
      const metricNode = editorNode.querySelector('.metric');

      if (wrapperClasses.contains('context-range')) {
        // Rate ranges
        typeaheadContext = 'context-range';
        suggestionGroups.push({
          label: 'Range vector',
          items: [...RATE_RANGES],
        });
      } else if (wrapperClasses.contains('context-labels') && metricNode) {
        const metric = metricNode.textContent;
        const labelKeys = this.state.labelKeys[metric];
        if (labelKeys) {
          if ((text && text.startsWith('=')) || wrapperClasses.contains('attr-value')) {
            // Label values
            const labelKeyNode = getPreviousCousin(wrapperNode, '.attr-name');
            if (labelKeyNode) {
              const labelKey = labelKeyNode.textContent;
              const labelValues = this.state.labelValues[metric][labelKey];
              typeaheadContext = 'context-label-values';
              suggestionGroups.push({
                label: 'Label values',
                items: labelValues,
              });
            }
          } else {
            // Label keys
            typeaheadContext = 'context-labels';
            suggestionGroups.push({ label: 'Labels', items: labelKeys });
          }
        } else {
          this.fetchMetricLabels(metric);
        }
      } else if (wrapperClasses.contains('context-labels') && !metricNode) {
        // Empty name queries
        const defaultKeys = ['job', 'instance'];
        // Munge all keys that we have seen together
        const labelKeys = Object.keys(this.state.labelKeys).reduce((acc, metric) => {
          return acc.concat(this.state.labelKeys[metric].filter(key => acc.indexOf(key) === -1));
        }, defaultKeys);
        if ((text && text.startsWith('=')) || wrapperClasses.contains('attr-value')) {
          // Label values
          const labelKeyNode = getPreviousCousin(wrapperNode, '.attr-name');
          if (labelKeyNode) {
            const labelKey = labelKeyNode.textContent;
            if (this.state.labelValues[EMPTY_METRIC]) {
              const labelValues = this.state.labelValues[EMPTY_METRIC][labelKey];
              typeaheadContext = 'context-label-values';
              suggestionGroups.push({
                label: 'Label values',
                items: labelValues,
              });
            } else {
              // Can only query label values for now (API to query keys is under development)
              this.fetchLabelValues(labelKey);
            }
          }
        } else {
          // Label keys
          typeaheadContext = 'context-labels';
          suggestionGroups.push({ label: 'Labels', items: labelKeys });
        }
      } else if (modelPrefix.match(/(^\s+$)|(\)\s+$)/)) {
        // Operators after functions
        typeaheadContext = 'context-operator';
        suggestionGroups.push({
          prefixMatch: true,
          label: 'Operators',
          items: ['|>', '<-', '+', '-', '*', '/', '<', '>', '<=', '=>', '==', '=~', '!=', '!~'],
        });
      } else if (prefix) {
        // Need prefix for functions
        typeaheadContext = 'context-builtin';
        suggestionGroups.push({
          prefixMatch: true,
          label: 'Functions',
          items: FUNCTIONS,
        });
      } else if (Plain.serialize(this.state.value) === '' || text.match(/[+\-*/^%]/)) {
        // Need prefix for functions
        typeaheadContext = 'context-new';
        suggestionGroups.push({
          prefixMatch: true,
          label: 'Functions',
          items: ['from(db: "telegraf") |> range($range) '],
        });
        suggestionGroups.push({
          prefixMatch: true,
          label: 'Shortcodes',
          items: ['telegraf..'],
        });
      }

      let results = 0;
      const filteredSuggestions = suggestionGroups.map(group => {
        if (group.items && prefix) {
          group.items = group.items.filter(c => c.length >= prefix.length);
          if (group.prefixMatch) {
            group.items = group.items.filter(c => c.indexOf(prefix) === 0);
          } else {
            group.items = group.items.filter(c => c.indexOf(prefix) > -1);
          }
        }
        results += group.items.length;
        return group;
      });

      console.log('handleTypeahead', selection.anchorNode, wrapperClasses, text, offset, prefix, typeaheadContext);

      this.setState({
        typeaheadPrefix: prefix,
        typeaheadContext,
        typeaheadText: text,
        suggestions: results > 0 ? filteredSuggestions : [],
      });
    }
  }, TYPEAHEAD_DEBOUNCE);

  applyTypeahead(change, suggestion) {
    const { typeaheadPrefix, typeaheadContext, typeaheadText } = this.state;
    let move = 0;

    // Modify suggestion based on context
    switch (typeaheadContext) {
      case 'context-builtin': {
        const nextChar = getNextCharacter();
        if (!nextChar && nextChar !== '(') {
          suggestion += '()';
          move = -1;
        }
        break;
      }

      case 'context-operator': {
        const nextChar = getNextCharacter();
        if (!nextChar && nextChar !== ' ') {
          suggestion += ' ';
        }
        break;
      }

      case 'context-labels': {
        const nextChar = getNextCharacter();
        if (!nextChar || nextChar === '}' || nextChar === ',') {
          suggestion += '=';
        }
        break;
      }

      case 'context-label-values': {
        // Always add quotes and remove existing ones instead
        if (!(typeaheadText.startsWith('="') || typeaheadText.startsWith('"'))) {
          suggestion = `"${suggestion}`;
        }
        if (getNextCharacter() !== '"') {
          suggestion = `${suggestion}"`;
        }
        break;
      }

      default:
    }

    this.resetTypeahead();

    // Remove the current, incomplete text and replace it with the selected suggestion
    const backward = typeaheadPrefix.length;
    const text = cleanText(typeaheadText);
    const suffixLength = text.length - typeaheadPrefix.length;
    const offset = typeaheadText.indexOf(typeaheadPrefix);
    const midWord = typeaheadPrefix && ((suffixLength > 0 && offset > -1) || suggestion === typeaheadText);
    const forward = midWord ? suffixLength + offset : 0;

    return (
      change
        // TODO this line breaks if cursor was moved left and length is longer than whole prefix
        .deleteBackward(backward)
        .deleteForward(forward)
        .insertText(suggestion)
        .move(move)
        .focus()
    );
  }
}
