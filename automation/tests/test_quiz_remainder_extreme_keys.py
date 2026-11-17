import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'lib'))
from quiz_remainder_extreme_keys import verify_remainder_extremes as verify


class RemainderExtremeTests(unittest.TestCase):
    def test_original_keys_and_independent_arithmetic(self):
        result=verify([32,36,43,45],5,'答案：(３)ˇ；(４)╳',[3,4])
        self.assertEqual(result['remainders'],[2,1,3,0])

    def test_zero_remainder_is_valid_minimum(self):
        self.assertEqual(verify([23,12,14],6,'(1)V;(2)X',[1,2])['minimum_index_1based'],2)

    def test_teacher_or_review_disagreement_rejected(self):
        for key,review in [('(1)V;(4)X',[1,4]),('(3)V;(4)X',[4,3])]:
            with self.assertRaisesRegex(ValueError,'mismatch'):verify([32,36,43,45],5,key,review)

    def test_tied_maximum_minimum_or_same_values_rejected(self):
        for values in [[11,21,10],[11,20,30],[12,22,32]]:
            with self.assertRaisesRegex(ValueError,'unique'):verify(values,10,'(1)V;(3)X',[1,3])

    def test_boolean_answer_without_labeled_roles_is_not_a_pair(self):
        for key in ['V;X','(1)X;(2)V','(1)V;(1)X','(1)V;(2)X;extra']:
            with self.assertRaises(ValueError):verify([11,12],10,key,[2,1])

    def test_invalid_or_unbounded_original_values(self):
        for values,divisor in [([1],5),([1,2],0),([True,2],5),([1,-2],5),([1,2],True),([1,10**10],3)]:
            with self.assertRaises(ValueError):verify(values,divisor,'(1)V;(2)X',[1,2])


if __name__=='__main__':unittest.main()
