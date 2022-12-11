# --------------------------------------------------------------------------- #
#   Copyright (c) 2011-2022 Proofscape contributors                           #
#                                                                             #
#   Licensed under the Apache License, Version 2.0 (the "License");           #
#   you may not use this file except in compliance with the License.          #
#   You may obtain a copy of the License at                                   #
#                                                                             #
#       http://www.apache.org/licenses/LICENSE-2.0                            #
#                                                                             #
#   Unless required by applicable law or agreed to in writing, software       #
#   distributed under the License is distributed on an "AS IS" BASIS,         #
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  #
#   See the License for the specific language governing permissions and       #
#   limitations under the License.                                            #
# --------------------------------------------------------------------------- #

import pytest

from tools.deploy import WheelFile

@pytest.mark.parametrize(['a', 'b'], (
    ('pfsc_examp-0.22.7-py3-none-any.whl', 'pfsc_examp-0.22.8-py3-none-any.whl'),
    ('pfsc_examp-0.22.7-py3-none-any.whl', 'pfsc_examp-0.23.0-py3-none-any.whl'),
    ('pfsc_examp-0.22.7-py3-none-any.whl', 'pfsc_examp-1.0.0-py3-none-any.whl'),
    ('pfsc_examp-0.22.8a1-py3-none-any.whl', 'pfsc_examp-0.22.8-py3-none-any.whl'),
    ('pfsc_examp-0.22.8.dev0-py3-none-any.whl', 'pfsc_examp-0.22.8-py3-none-any.whl'),
    ('pfsc_examp-0.22.8a2.dev0-py3-none-any.whl', 'pfsc_examp-0.22.8-py3-none-any.whl'),
))
def test_ordering(a, b):
    assert WheelFile(a) < WheelFile(b)
