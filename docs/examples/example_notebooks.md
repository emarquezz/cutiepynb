# Example notebook

[`Test.ipynb`](Test.ipynb) is a deliberately small source notebook with three
heading levels. Process it from the repository root:

```bash
cutiepynb docs/examples/Test.ipynb \
  --color "#40498e" \
  --color "#357ba3" \
  --color "#38aaac" \
  --color "#79d6ae"
```

Alternatively, run `python run_examples.py`. Both commands create
`docs/examples/Test_chulo.ipynb` for local inspection; the generated file is not
part of the source distribution.
