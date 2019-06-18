import React, { Component } from 'react'
import pureRender from 'pure-render-decorator'

import { options, requireAddons } from '../../utils/CodeMirror'
import { prefixObject } from '../../utils/PrefixInlineStyles'
import { highlightAddedLines } from '../../utils/Diff'

require("../../node_modules/codemirror/lib/codemirror.css")
require("../../styles/codemirror-theme.css")

// Work around a codemirror + flexbox + chrome issue by creating an absolute
// positioned parent and flex grandparent of the codemirror element.
// https://github.com/jlongster/debugger.html/issues/63
const styles = prefixObject({
  editorContainer: {
    display: 'flex',
    position: 'relative',
    flex: '1',
    minWidth: 0,
    minHeight: 0,
  },
  editor: {
    position: 'absolute',
    height: '100%',
    width: '100%',
  },
})

const docCache = {}

@pureRender
export default class extends Component {

  static defaultProps = {
    initialValue: null,
    value: null,
    onChange: () => {},
    readOnly: false,
    showDiff: false,
    diff: [],
  }

  currentDiff = []

  componentDidMount() {
    if (typeof navigator !== 'undefined') {
      const {filename, initialValue, value, readOnly, onChange, diff} = this.props

      requireAddons()
      const CodeMirror = require('codemirror')

      if (!docCache[filename]) {
        docCache[filename] = new CodeMirror.Doc(initialValue || value || '', options.mode)
      }

      this.cm = CodeMirror(
        this.refs.editor,
        {
          ...options,
          readOnly,
          value: docCache[filename].linkedDoc({sharedHist: true}),
        }
      )

      this.cm.on('beforeChange', (cm) => {
        this.currentDiff.forEach(range => {
          for (let i = range[0]; i <= range[1]; i++) {
            this.cm.removeLineClass(i, "background", "cm-line-changed")
            this.cm.removeLineClass(i, "gutter", "cm-line-changed")
          }
        })
      })

      this.cm.on('changes', (cm) => {
        onChange(cm.getValue())
      })

      // If this document is unmodified, highlight the diff
      const historySize = docCache[filename].historySize()

      if (historySize.undo === 0) {
        this.highlightDiff()
      }
    }
  }

  componentWillUnmount() {
    if (typeof navigator !== 'undefined') {
      const {filename} = this.props
      const CodeMirror = require('codemirror')

      // Store a reference to the current linked doc
      const linkedDoc = this.cm.doc

      this.cm.swapDoc(new CodeMirror.Doc('', options.mode))

      // Unlink the doc
      docCache[filename].unlinkDoc(linkedDoc)
    }
  }

  highlightDiff() {
    const CodeMirror = require('codemirror')

    if (!this.cm) return;

    const { showDiff, diff } = this.props

    if (showDiff) {
      diff.forEach(range => {
        for (let i = range[0]; i <= range[1]; i++) {
          this.cm.addLineClass(i, "gutter", "cm-line-changed")
          this.cm.addLineClass(i, "background", "cm-line-changed")
        }
      })

      if (diff.length > 0) {
        const scrollInfo = this.cm.getScrollInfo();

        const fromLine = diff[0][0]
        const toLine = diff[diff.length - 1][1]

        const fromHeight = this.cm.heightAtLine(fromLine);
        const toHeight = this.cm.heightAtLine(toLine);

        const visibleHeight = toHeight - fromHeight;

        if (visibleHeight < scrollInfo.clientHeight) {
          const middleLine = fromLine + Math.floor((toLine - fromLine) / 2);
          this.cm.scrollIntoView(CodeMirror.Pos(middleLine, 0), scrollInfo.clientHeight / 2)
        } else {
          this.cm.scrollIntoView(CodeMirror.Pos(fromLine, 0), scrollInfo.clientHeight / 2)
        }
      }

      this.currentDiff = diff;
    }
  }

  componentWillUpdate(nextProps) {
    const {errorLineNumber: nextLineNumber, value} = nextProps
    const {errorLineNumber: prevLineNumber} = this.props

    if (this.cm) {
      if (typeof prevLineNumber === 'number') {
        this.cm.removeLineClass(prevLineNumber, "background", "cm-line-error")
      }

      if (typeof nextLineNumber === 'number') {
        this.cm.addLineClass(nextLineNumber, "background", "cm-line-error")
      }

      const oldValue = this.cm.getValue()

      if (typeof value === 'string' && value !== oldValue) {
        this.cm.setValue(value)
      }
    }
  }

  render() {
    const {readOnly} = this.props

    return (
      <div style={styles.editorContainer} className={readOnly ? 'read-only' : undefined}>
        <div style={styles.editor} ref={'editor'} />
      </div>
    )
  }
}
