# Get Strongest Version Label Exist
> Generated from [Action - JavaScript Action template](https://github.com/actions/javascript-action)

Do you want to get the strongest version label in PR?

## Inputs
- `labels` (look below for the labels format)
- `GitHubToken` (set to `secrets.GITHUB_TOKEN`)
  >  Provided by GitHub Actions

#### Labels format
You can pass the labels input at one of 3 format 

> Before enplaning the formats there are 2 concepts you need to know
> 1. `labelName` The name of the label (Mandatory)
> 2. `value` The value of that label (Optional - if not provided, the `labelName` will be the value)

> One more note: Spaces are trimmed

##### JSON - Array of objects
> For the JSON to work, it must be `stringify`

Array of object, each object have: `labelName` and `value` (as explained before)

**Example:**
```json
[
  {
    "labelName": "your-label-name",
    "value": "the value you want to get if that label is choose"
  },
  {
    "labelName": "your-label-name-which-is-also-the-value"
  }
]
```

##### JSON - Array of Arrays
> For the JSON to work, it must be `stringify`

Array of arrays, each sub-array have 1 or 2 items:
- 1st item is the `labelName`
- 2nd item is the `value`

**Example:**
```json
[
  ["your-label-name", "the value you want to get if that label is choose"],
  ["your-label-name-which-is-also-the-value"]
]
```

##### Multiline String
> For using multiline, use the `|` character

String that each line is item that have 2 parts divided by `,` (comma):
- 1st part is the `labelName`
- 2nd part is the `value`

**Example:**
```
your-label-name, the value you want to get if that label is choose
your-label-name-which-is-also-the-value
```

## Outputs
```yaml
strongestLabelName: The strongest label name exist (`input.minor` is `bump:minor` and `input.patch` is `bump:patch` so the `strongestLabel` is `bump:minor`)

strongestLabelValue: The value of strongestLabel (`input.major` is `bump:major` so the `strongestLabelText` is `major`)

error: 0 for No error | 1 for no pull request (on push without pull request associated with that commit) | 2 for no matching label 
```

Example:

```yaml
name: CI
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: rluvaton/get-strongest-label-in-pr-action@master
      id: strongestLabel
      with:
        GitHubToken: ${{ secrets.GITHUB_TOKEN }} # Provided by GitHub Actions
        labels: "[[\"bump:major\", \"major\"],[\"bump:minor\", \"minor\"],[\"bump:patch\", \"patch\"]]"

    - name: Echo Label if it's merged pull request commit
      if: steps.strongestLabel.outputs.error == 0 # No Error
      run: echo ${{steps.strongestLabel.outputs.strongestLabelValue}} 
```
