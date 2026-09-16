# Supression

During the audit process `odid` looks for `.odid/supressions.md` file (see [example](examples/supressions.md)).

Supressions defines risk descriptions that should ignored during the audit. The format of the supression definition is:

```md
> Please don't do XXX.

We would like to do XXX anyway.

> Please don't do YYY.

Nope. We would like to do YYY anyway.
```

Where we cite description of the risk to be ignored and then explanation why we would like it to be suppressed. Description is not matched 1:1 - we would like to ignore also very similar descriptions.

Base audit prompt should be enhanced with the supression instructions and `.odid/supressions.md` data.
